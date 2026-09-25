import ExpoModulesCore
import UIKit

public class PasteboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Pasteboard")

    // One pasteboard item with several typed representations, custom types
    // included (expo-clipboard writes only text or an image), removed after
    // `seconds`. Instagram and Facebook Stories read their sticker this way.
    AsyncFunction("setItem") { (strings: [String: String], data: [String: Data], seconds: Double) in
      var item: [String: Any] = strings
      for (type, bytes) in data {
        item[type] = bytes
      }
      UIPasteboard.general.setItems([item], options: [.expirationDate: Date(timeIntervalSinceNow: seconds)])
    }.runOnQueue(.main)
  }
}
