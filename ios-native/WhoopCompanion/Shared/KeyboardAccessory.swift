import UIKit
import ObjectiveC

// MARK: - Global "Done" keyboard accessory
//
// Installs a single UIToolbar with a right-aligned "Done" button as the
// inputAccessoryView on every UITextField / UITextView the app presents.
// This guarantees:
//   • The Done button appears every time a keyboard is shown.
//   • Exactly one Done button is visible, regardless of how many fields
//     the parent SwiftUI view contains (no per-field `.toolbar` stacking).
//   • Tapping Done resigns the current first responder (dismisses keyboard).
//
// Call `KeyboardAccessorySetup.install()` once from the App's init().

enum KeyboardAccessorySetup {
    static func install() {
        UITextField.installDoneAccessorySwizzle
        UITextView.installDoneAccessorySwizzle
    }
}

@objc private final class KeyboardAccessoryTarget: NSObject {
    static let shared = KeyboardAccessoryTarget()
    @objc func dismiss() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil, from: nil, for: nil
        )
    }
}

private func makeDoneAccessory() -> UIToolbar {
    let tb = UIToolbar()
    tb.barStyle = .default
    tb.sizeToFit()
    let flex = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
    let done = UIBarButtonItem(
        barButtonSystemItem: .done,
        target: KeyboardAccessoryTarget.shared,
        action: #selector(KeyboardAccessoryTarget.dismiss)
    )
    tb.items = [flex, done]
    return tb
}

// MARK: - UITextField swizzle

extension UITextField {
    static let installDoneAccessorySwizzle: Void = {
        let cls: AnyClass = UITextField.self
        guard
            let original = class_getInstanceMethod(cls, #selector(becomeFirstResponder)),
            let replacement = class_getInstanceMethod(cls, #selector(swz_becomeFirstResponder))
        else { return }
        method_exchangeImplementations(original, replacement)
    }()

    @objc func swz_becomeFirstResponder() -> Bool {
        if inputAccessoryView == nil {
            inputAccessoryView = makeDoneAccessory()
        }
        // After swap, this calls the original implementation.
        return swz_becomeFirstResponder()
    }
}

// MARK: - UITextView swizzle

extension UITextView {
    static let installDoneAccessorySwizzle: Void = {
        let cls: AnyClass = UITextView.self
        guard
            let original = class_getInstanceMethod(cls, #selector(becomeFirstResponder)),
            let replacement = class_getInstanceMethod(cls, #selector(swz_becomeFirstResponder))
        else { return }
        method_exchangeImplementations(original, replacement)
    }()

    @objc func swz_becomeFirstResponder() -> Bool {
        if inputAccessoryView == nil, isEditable {
            inputAccessoryView = makeDoneAccessory()
        }
        return swz_becomeFirstResponder()
    }
}
