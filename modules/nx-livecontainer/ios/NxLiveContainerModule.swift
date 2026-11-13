import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers
import Network

private class DocumentPickerDelegateHandler: NSObject, UIDocumentPickerDelegate {
  private let completion: (Result<URL, Error>) -> Void

  init(completion: @escaping (Result<URL, Error>) -> Void) {
    self.completion = completion
    super.init()
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let pickedUrl = urls.first else {
      completion(.failure(NSError(domain: "NxLiveContainer", code: -1, userInfo: [NSLocalizedDescriptionKey: "No folder selected"])))
      return
    }
    completion(.success(pickedUrl))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(.failure(NSError(domain: "NxLiveContainer", code: -2, userInfo: [NSLocalizedDescriptionKey: "User cancelled folder selection"])))
  }
}

public class NxLiveContainerModule: Module {
  private var activePickerDelegate: DocumentPickerDelegateHandler?
  private let bookmarkKey = "NxLiveContainerBookmark"
  private let folderNameKey = "NxLiveContainerFolderName"
  private let folderPathKey = "NxLiveContainerFolderPath"
  private let networkMonitor = NWPathMonitor()
  private var currentNetworkPath: NWPath?
  private var batteryObservers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("NxLiveContainer")

    Events(
      "onBatteryChanged",
      "onNetworkChanged"
    )

    OnCreate {
      UIDevice.current.isBatteryMonitoringEnabled = true
      self.setupBatteryMonitoring()
      self.setupNetworkMonitoring()
    }

    OnDestroy {
      self.stopMonitoring()
    }

    Function("getBatteryStatus") { () -> [String: Any] in
      UIDevice.current.isBatteryMonitoringEnabled = true
      let rawLevel = UIDevice.current.batteryLevel
      let level = rawLevel >= 0 ? Int(round(rawLevel * 100)) : 100
      let isCharging = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
      return [
        "level": level,
        "isCharging": isCharging,
        "state": UIDevice.current.batteryState.rawValue
      ]
    }

    Function("getNetworkStatus") { () -> [String: Any] in
      let path = self.currentNetworkPath
      let isConnected = path?.status == .satisfied
      let isWifi = path?.usesInterfaceType(.wifi) ?? false
      let isCellular = path?.usesInterfaceType(.cellular) ?? false
      return [
        "isConnected": isConnected,
        "isWifi": isWifi,
        "isCellular": isCellular
      ]
    }

    AsyncFunction("pickLiveContainerFolder") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else {
          promise.reject("ERR_DEALLOCATED", "Module instance deallocated")
          return
        }

        guard let currentVc = self.appContext?.utilities?.currentViewController() else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "Could not find top view controller to present folder picker")
          return
        }

        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
        picker.allowsMultipleSelection = false

        let handler = DocumentPickerDelegateHandler { [weak self] result in
          self?.activePickerDelegate = nil
          switch result {
          case .success(let url):
            do {
              guard url.startAccessingSecurityScopedResource() else {
                promise.reject("ERR_SECURITY_SCOPE", "Failed to access security-scoped resource")
                return
              }
              defer { url.stopAccessingSecurityScopedResource() }

              let bookmarkData = try url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
              )

              UserDefaults.standard.set(bookmarkData, forKey: self?.bookmarkKey ?? "NxLiveContainerBookmark")
              UserDefaults.standard.set(url.lastPathComponent, forKey: self?.folderNameKey ?? "NxLiveContainerFolderName")
              UserDefaults.standard.set(url.path, forKey: self?.folderPathKey ?? "NxLiveContainerFolderPath")

              promise.resolve([
                "isLinked": true,
                "folderName": url.lastPathComponent,
                "folderPath": url.path
              ])
            } catch {
              promise.reject("ERR_BOOKMARK", "Failed to create security-scoped bookmark: \(error.localizedDescription)")
            }

          case .failure(let error as NSError) where error.code == -2:
            promise.resolve([
              "isLinked": false,
              "cancelled": true
            ])

          case .failure(let error):
            promise.reject("ERR_PICKER", error.localizedDescription)
          }
        }

        self.activePickerDelegate = handler
        picker.delegate = handler
        currentVc.present(picker, animated: true, completion: nil)
      }
    }

    Function("isLinked") { () -> [String: Any] in
      let hasBookmark = UserDefaults.standard.data(forKey: self.bookmarkKey) != nil
      var folderName = UserDefaults.standard.string(forKey: self.folderNameKey) ?? ""
      var folderPath = UserDefaults.standard.string(forKey: self.folderPathKey) ?? ""

      if hasBookmark {
        return [
          "isLinked": true,
          "folderName": folderName,
          "folderPath": folderPath
        ]
      }

      // Check auto-detection if running inside LiveContainer
      if let resolved = self.resolveRootFolderUrl() {
        if resolved.shouldStopAccess {
          resolved.url.stopAccessingSecurityScopedResource()
        }
        folderName = resolved.url.lastPathComponent
        folderPath = resolved.url.path
        return [
          "isLinked": true,
          "folderName": folderName.isEmpty ? "LiveContainer (Auto)" : folderName,
          "folderPath": folderPath,
          "autoDetected": true
        ]
      }

      return [
        "isLinked": false,
        "folderName": "",
        "folderPath": ""
      ]
    }

    Function("unlinkFolder") { () -> Bool in
      UserDefaults.standard.removeObject(forKey: self.bookmarkKey)
      UserDefaults.standard.removeObject(forKey: self.folderNameKey)
      UserDefaults.standard.removeObject(forKey: self.folderPathKey)
      return true
    }

    AsyncFunction("openLiveContainerUrl") { (urlString: String, promise: Promise) in
      DispatchQueue.main.async {
        guard let url = URL(string: urlString) else {
          promise.reject("ERR_INVALID_URL", "Invalid URL string")
          return
        }

        // 1. Attempt launch via LSApplicationWorkspace to bypass SpringBoard modal if permitted
        if let workspaceClass = NSClassFromString("LSApplicationWorkspace") as? NSObject.Type,
           let workspace = workspaceClass.perform(NSSelectorFromString("defaultWorkspace"))?.takeUnretainedValue() as? NSObject {

          let openSensitiveSel = NSSelectorFromString("openSensitiveURL:withOptions:")
          if workspace.responds(to: openSensitiveSel) {
            _ = workspace.perform(openSensitiveSel, with: url, with: nil)
            promise.resolve(true)
            return
          }

          let openURLSel = NSSelectorFromString("openURL:")
          if workspace.responds(to: openURLSel) {
            _ = workspace.perform(openURLSel, with: url)
            promise.resolve(true)
            return
          }
        }

        // 2. Fallback to standard UIApplication.shared.open
        UIApplication.shared.open(url, options: [:]) { success in
          promise.resolve(success)
        }
      }
    }

    AsyncFunction("writeGameEnvConfig") { (containerFolder: String, config: [String: String], promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async { [weak self] in
        guard let self = self else {
          promise.reject("ERR_DEALLOCATED", "Module deallocated")
          return
        }

        guard let resolved = self.resolveRootFolderUrl() else {
          promise.reject("ERR_NOT_LINKED", "LiveContainer root folder is not linked or detected")
          return
        }

        defer {
          if resolved.shouldStopAccess {
            resolved.url.stopAccessingSecurityScopedResource()
          }
        }

        do {
          let rootUrl = resolved.url

          guard let targetDocsUrl = self.findDocumentsDirectory(rootUrl: rootUrl, containerFolder: containerFolder) else {
            promise.reject("ERR_CONTAINER_NOT_FOUND", "Could not locate container directory for: \(containerFolder)")
            return
          }

          let envFileUrl = targetDocsUrl.appendingPathComponent("env.txt")

          // Read existing lines if any
          var envMap: [String: String] = [
            "DM_LAUNCHER": "0",
            "DM_FULLSCREEN": "1",
            "DM_SAVED_CHOICES": "1"
          ]

          if FileManager.default.fileExists(atPath: envFileUrl.path),
             let existingContent = try? String(contentsOf: envFileUrl, encoding: .utf8) {
            for line in existingContent.components(separatedBy: .newlines) {
              let trimmed = line.trimmingCharacters(in: .whitespaces)
              if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
              let parts = trimmed.split(separator: "=", maxSplits: 1).map(String.init)
              if parts.count == 2 {
                envMap[parts[0].trimmingCharacters(in: .whitespaces)] = parts[1].trimmingCharacters(in: .whitespaces)
              }
            }
          }

          // Apply new overrides
          for (k, v) in config {
            envMap[k] = v
          }

          // Ensure FPS target synchronizes all known key variations so no stale variable overrides it
          if let fps = config["DM_FPS_TARGET"] ?? config["DM_FPS"] {
            envMap["DM_FPS"] = fps
            envMap["DM_FPS_TARGET"] = fps
            envMap["DM_MAX_FPS"] = fps
            envMap["DM_FRAME_RATE"] = fps
          }

          // Ensure OpMode writes both integer (for atoi) and string representations
          if let mode = config["DM_OPMODE"] ?? config["DM_OPERATION_MODE"] {
            let isDocked = mode == "1" || mode.lowercased() == "docked"
            envMap["DM_OPMODE"] = isDocked ? "1" : "0"
            envMap["DM_OPERATION_MODE"] = isDocked ? "docked" : "handheld"
          }

          // Generate file content
          let content = envMap.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: "\n") + "\n"
          try content.write(to: envFileUrl, atomically: true, encoding: .utf8)

          // Mirror to container root (Data/Application/<UUID>/env.txt)
          let containerRoot = targetDocsUrl.deletingLastPathComponent()
          let containerRootEnv = containerRoot.appendingPathComponent("env.txt")
          try? content.write(to: containerRootEnv, atomically: true, encoding: .utf8)

          // Mirror into any .app bundles in container root (Data/Application/<UUID>/*.app/env.txt)
          if let dirContents = try? FileManager.default.contentsOfDirectory(at: containerRoot, includingPropertiesForKeys: nil) {
            for item in dirContents where item.pathExtension.lowercased() == "app" {
              let appEnv = item.appendingPathComponent("env.txt")
              try? content.write(to: appEnv, atomically: true, encoding: .utf8)
            }
          }

          promise.resolve([
            "success": true,
            "containerFolder": containerFolder,
            "envPath": envFileUrl.path,
            "appliedConfig": envMap
          ])
        } catch {
          promise.reject("ERR_WRITE", "Failed to resolve or write env.txt: \(error.localizedDescription)")
        }
      }
    }

    AsyncFunction("readGameEnvConfig") { (containerFolder: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async { [weak self] in
        guard let self = self else {
          promise.reject("ERR_DEALLOCATED", "Module deallocated")
          return
        }

        guard let resolved = self.resolveRootFolderUrl() else {
          promise.resolve([:])
          return
        }

        defer {
          if resolved.shouldStopAccess {
            resolved.url.stopAccessingSecurityScopedResource()
          }
        }

        do {
          let rootUrl = resolved.url

          guard let targetDocsUrl = self.findDocumentsDirectory(rootUrl: rootUrl, containerFolder: containerFolder) else {
            promise.resolve([:])
            return
          }

          let envFileUrl = targetDocsUrl.appendingPathComponent("env.txt")
          guard FileManager.default.fileExists(atPath: envFileUrl.path),
                let existingContent = try? String(contentsOf: envFileUrl, encoding: .utf8) else {
            promise.resolve([:])
            return
          }

          var result: [String: String] = [:]
          for line in existingContent.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            let parts = trimmed.split(separator: "=", maxSplits: 1).map(String.init)
            if parts.count == 2 {
              result[parts[0].trimmingCharacters(in: .whitespaces)] = parts[1].trimmingCharacters(in: .whitespaces)
            }
          }

          promise.resolve(result)
        } catch {
          promise.resolve([:])
        }
      }
    }
  }

  private func resolveRootFolderUrl() -> (url: URL, shouldStopAccess: Bool)? {
    let fm = FileManager.default

    // 1. If user previously picked a folder via document picker, resolve security-scoped bookmark
    if let bookmarkData = UserDefaults.standard.data(forKey: self.bookmarkKey) {
      var isStale = false
      if let rootUrl = try? URL(resolvingBookmarkData: bookmarkData, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &isStale) {
        if rootUrl.startAccessingSecurityScopedResource() {
          return (rootUrl, true)
        }
      }
    }

    // 2. Auto-detection: If running directly inside LiveContainer, check direct sandbox Documents
    if let docsUrl = fm.urls(for: .documentDirectory, in: .userDomainMask).first {
      // Check if Documents contains Data/Application (or in parent directory)
      let candidates = [
        docsUrl,
        docsUrl.deletingLastPathComponent(),
        docsUrl.appendingPathComponent("LiveContainer")
      ]

      for candidate in candidates {
        let dataApp = candidate.appendingPathComponent("Data/Application")
        var isDir: ObjCBool = false
        if fm.fileExists(atPath: dataApp.path, isDirectory: &isDir), isDir.boolValue {
          return (candidate, false)
        }
      }
    }

    // 3. Check saved path if present
    if let savedPath = UserDefaults.standard.string(forKey: self.folderPathKey), !savedPath.isEmpty {
      let pathUrl = URL(fileURLWithPath: savedPath)
      var isDir: ObjCBool = false
      if fm.fileExists(atPath: pathUrl.path, isDirectory: &isDir), isDir.boolValue {
        return (pathUrl, false)
      }
    }

    return nil
  }

  private func findDocumentsDirectory(rootUrl: URL, containerFolder: String) -> URL? {
    let fm = FileManager.default

    // Strategy 1: Prioritize exact casing: Data/Application (LiveContainer standard on iOS)
    let candidatePaths = [
      rootUrl.appendingPathComponent("Data/Application/\(containerFolder)/Documents"),
      rootUrl.appendingPathComponent("Data/Application/\(containerFolder)"),
      rootUrl.appendingPathComponent("Application/\(containerFolder)/Documents"),
      rootUrl.appendingPathComponent("Application/\(containerFolder)"),
      rootUrl.appendingPathComponent("data/application/\(containerFolder)/Documents"),
      rootUrl.appendingPathComponent("data/application/\(containerFolder)"),
      rootUrl.appendingPathComponent("\(containerFolder)/Documents"),
      rootUrl.appendingPathComponent("\(containerFolder)")
    ]

    for candidate in candidatePaths {
      var isDir: ObjCBool = false
      if fm.fileExists(atPath: candidate.path, isDirectory: &isDir), isDir.boolValue {
        if candidate.lastPathComponent == "Documents" {
          return candidate
        } else {
          let docs = candidate.appendingPathComponent("Documents")
          try? fm.createDirectory(at: docs, withIntermediateDirectories: true, attributes: nil)
          return docs
        }
      }
    }

    // Strategy 2: Check inside Data/Application or data/application dynamically
    let possibleBases = [
      rootUrl.appendingPathComponent("Data/Application"),
      rootUrl.appendingPathComponent("data/application"),
      rootUrl.appendingPathComponent("Application"),
      rootUrl.appendingPathComponent("application")
    ]

    for baseApps in possibleBases {
      if fm.fileExists(atPath: baseApps.path) {
        if let subdirs = try? fm.contentsOfDirectory(atPath: baseApps.path) {
          for sub in subdirs where sub.caseInsensitiveCompare(containerFolder) == .orderedSame {
            let containerUrl = baseApps.appendingPathComponent(sub)
            let docs = containerUrl.appendingPathComponent("Documents")
            try? fm.createDirectory(at: docs, withIntermediateDirectories: true, attributes: nil)
            return docs
          }
        }
      }
    }

    // Strategy 3: Deep search in rootUrl for any folder matching containerFolder name
    if let enumerator = fm.enumerator(
      at: rootUrl,
      includingPropertiesForKeys: [.isDirectoryKey],
      options: [.skipsHiddenFiles]
    ) {
      for case let itemUrl as URL in enumerator {
        if itemUrl.lastPathComponent.caseInsensitiveCompare(containerFolder) == .orderedSame {
          var isDir: ObjCBool = false
          if fm.fileExists(atPath: itemUrl.path, isDirectory: &isDir), isDir.boolValue {
            let docs = itemUrl.appendingPathComponent("Documents")
            try? fm.createDirectory(at: docs, withIntermediateDirectories: true, attributes: nil)
            return docs
          }
        }
      }
    }

    // Strategy 4: Fallback - create Data/Application/<containerFolder>/Documents
    let primaryTarget = rootUrl
      .appendingPathComponent("Data/Application")
      .appendingPathComponent(containerFolder)
      .appendingPathComponent("Documents")
    try? fm.createDirectory(at: primaryTarget, withIntermediateDirectories: true, attributes: nil)
    return primaryTarget
  }

  // MARK: - Battery & Network Monitoring
  private func setupBatteryMonitoring() {
    let levelObs = NotificationCenter.default.addObserver(
      forName: UIDevice.batteryLevelDidChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.emitBatteryEvent()
    }

    let stateObs = NotificationCenter.default.addObserver(
      forName: UIDevice.batteryStateDidChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.emitBatteryEvent()
    }

    batteryObservers = [levelObs, stateObs]
  }

  private func emitBatteryEvent() {
    let rawLevel = UIDevice.current.batteryLevel
    let level = rawLevel >= 0 ? Int(round(rawLevel * 100)) : 100
    let isCharging = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
    sendEvent("onBatteryChanged", [
      "level": level,
      "isCharging": isCharging,
      "state": UIDevice.current.batteryState.rawValue
    ])
  }

  private func setupNetworkMonitoring() {
    networkMonitor.pathUpdateHandler = { [weak self] path in
      guard let self = self else { return }
      self.currentNetworkPath = path
      self.sendEvent("onNetworkChanged", [
        "isConnected": path.status == .satisfied,
        "isWifi": path.usesInterfaceType(.wifi),
        "isCellular": path.usesInterfaceType(.cellular)
      ])
    }
    networkMonitor.start(queue: DispatchQueue.global(qos: .background))
  }

  private func stopMonitoring() {
    networkMonitor.cancel()
    for obs in batteryObservers {
      NotificationCenter.default.removeObserver(obs)
    }
    batteryObservers.removeAll()
  }
}
