import ExpoModulesCore
import GameController

public class NxGameControllerModule: Module {
  private var observers: [NSObjectProtocol] = []
  private var deadzone: Float = 0.15

  public func definition() -> ModuleDefinition {
    Name("NxGameController")

    Events(
      "onControllerConnected",
      "onControllerDisconnected",
      "onButtonPress",
      "onThumbstickMove"
    )

    OnCreate {
      self.setupControllerObservers()
      self.pollExistingControllers()
    }

    OnDestroy {
      self.removeObservers()
    }

    Function("getConnectedControllers") { () -> [[String: Any]] in
      return GCController.controllers().map { controller in
        self.serializeController(controller)
      }
    }

    Function("setDeadzone") { (value: Double) in
      self.deadzone = Float(max(0.01, min(0.5, value)))
    }
  }

  private func setupControllerObservers() {
    let connectObserver = NotificationCenter.default.addObserver(
      forName: .GCControllerDidConnect,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard let self = self, let controller = notification.object as? GCController else { return }
      self.attachInputHandlers(to: controller)
      self.sendEvent("onControllerConnected", self.serializeController(controller))
    }

    let disconnectObserver = NotificationCenter.default.addObserver(
      forName: .GCControllerDidDisconnect,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard let self = self, let controller = notification.object as? GCController else { return }
      self.sendEvent("onControllerDisconnected", [
        "id": String(controller.hashValue),
        "vendorName": controller.vendorName ?? "Unknown Gamepad"
      ])
    }

    observers.append(contentsOf: [connectObserver, disconnectObserver])
  }

  private func pollExistingControllers() {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      for controller in GCController.controllers() {
        self.attachInputHandlers(to: controller)
      }
    }
  }

  private func attachInputHandlers(to controller: GCController) {
    guard let gamepad = controller.extendedGamepad else { return }

    // Face Buttons
    gamepad.buttonA.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "A", pressed: pressed, value: value)
    }
    gamepad.buttonB.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "B", pressed: pressed, value: value)
    }
    gamepad.buttonX.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "X", pressed: pressed, value: value)
    }
    gamepad.buttonY.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "Y", pressed: pressed, value: value)
    }

    // D-Pad
    gamepad.dpad.up.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "UP", pressed: pressed, value: value)
    }
    gamepad.dpad.down.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "DOWN", pressed: pressed, value: value)
    }
    gamepad.dpad.left.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "LEFT", pressed: pressed, value: value)
    }
    gamepad.dpad.right.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "RIGHT", pressed: pressed, value: value)
    }

    // Shoulders & Triggers
    gamepad.leftShoulder.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "L1", pressed: pressed, value: value)
    }
    gamepad.rightShoulder.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "R1", pressed: pressed, value: value)
    }
    gamepad.leftTrigger.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "L2", pressed: pressed, value: value)
    }
    gamepad.rightTrigger.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "R2", pressed: pressed, value: value)
    }

    // Options / Menu / Start / Select
    gamepad.buttonMenu.valueChangedHandler = { [weak self] _, value, pressed in
      self?.sendButtonEvent(button: "START", pressed: pressed, value: value)
    }
    if let options = gamepad.buttonOptions {
      options.valueChangedHandler = { [weak self] _, value, pressed in
        self?.sendButtonEvent(button: "SELECT", pressed: pressed, value: value)
      }
    }

    // Left Thumbstick
    gamepad.leftThumbstick.valueChangedHandler = { [weak self] _, xValue, yValue in
      guard let self = self else { return }
      let x = abs(xValue) > self.deadzone ? Double(xValue) : 0.0
      let y = abs(yValue) > self.deadzone ? Double(yValue) : 0.0
      self.sendEvent("onThumbstickMove", [
        "axis": "left",
        "x": x,
        "y": y
      ])
    }

    // Right Thumbstick
    gamepad.rightThumbstick.valueChangedHandler = { [weak self] _, xValue, yValue in
      guard let self = self else { return }
      let x = abs(xValue) > self.deadzone ? Double(xValue) : 0.0
      let y = abs(yValue) > self.deadzone ? Double(yValue) : 0.0
      self.sendEvent("onThumbstickMove", [
        "axis": "right",
        "x": x,
        "y": y
      ])
    }
  }

  private func sendButtonEvent(button: String, pressed: Bool, value: Float) {
    sendEvent("onButtonPress", [
      "button": button,
      "pressed": pressed,
      "value": Double(value)
    ])
  }

  private func serializeController(_ controller: GCController) -> [String: Any] {
    var batteryLevel: Double? = nil
    if let battery = controller.battery {
      batteryLevel = Double(battery.batteryLevel * 100.0)
    }

    return [
      "id": String(controller.hashValue),
      "vendorName": controller.vendorName ?? "Gamepad",
      "isAttachedToDevice": controller.isAttachedToDevice,
      "playerIndex": controller.playerIndex.rawValue,
      "hasBattery": controller.battery != nil,
      "batteryLevel": batteryLevel as Any
    ]
  }

  private func removeObservers() {
    for observer in observers {
      NotificationCenter.default.removeObserver(observer)
    }
    observers.removeAll()
  }
}
