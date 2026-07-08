import SwiftUI
import UIKit

// MARK: - Keyboard dismissal helpers

/// Adds a "Done" button above the keyboard that resigns first responder.
/// Essential for `.numberPad` / `.decimalPad` which have no Return key.
struct KeyboardDoneToolbar: ViewModifier {
    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil, from: nil, for: nil
                    )
                }
                .font(.body.weight(.semibold))
            }
        }
    }
}

extension View {
    /// Attach a "Done" accessory to the current keyboard.
    func keyboardDoneToolbar() -> some View { modifier(KeyboardDoneToolbar()) }

    /// Dismiss any active keyboard when tapping an empty area of the view.
    func dismissKeyboardOnTap() -> some View {
        contentShape(Rectangle())
            .onTapGesture {
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder),
                    to: nil, from: nil, for: nil
                )
            }
    }
}


// MARK: - Field label with required/optional badge

struct FieldLabel: View {
    let text: String
    let isRequired: Bool
    let hint: String?

    init(_ text: String, required: Bool = false, hint: String? = nil) {
        self.text = text
        self.isRequired = required
        self.hint = hint
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Text(text)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                if isRequired {
                    Text("Required")
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 5).padding(.vertical, 1.5)
                        .background(Theme.accent.opacity(0.15), in: Capsule())
                        .foregroundStyle(Theme.accent)
                } else {
                    Text("Optional")
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 5).padding(.vertical, 1.5)
                        .background(Color.secondary.opacity(0.12), in: Capsule())
                        .foregroundStyle(.secondary)
                }
            }
            if let hint {
                Text(hint).font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Numeric field with unit suffix

struct NumericField: View {
    let title: String
    let unit: String?
    let placeholder: String
    let isRequired: Bool
    let hint: String?
    @Binding var text: String
    var keyboard: UIKeyboardType = .decimalPad

    init(_ title: String,
         unit: String? = nil,
         placeholder: String = "—",
         required: Bool = false,
         hint: String? = nil,
         text: Binding<String>,
         keyboard: UIKeyboardType = .decimalPad) {
        self.title = title
        self.unit = unit
        self.placeholder = placeholder
        self.isRequired = required
        self.hint = hint
        self._text = text
        self.keyboard = keyboard
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            FieldLabel(title, required: isRequired, hint: hint)
            HStack {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboard)
                if let unit {
                    Text(unit).font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
    }
}

// MARK: - Text field wrapper

struct LabeledTextField: View {
    let title: String
    let placeholder: String
    let isRequired: Bool
    let hint: String?
    @Binding var text: String
    var isSecure: Bool = false
    var keyboard: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var autocorrect: Bool = true

    init(_ title: String,
         placeholder: String = "",
         required: Bool = false,
         hint: String? = nil,
         text: Binding<String>,
         isSecure: Bool = false,
         keyboard: UIKeyboardType = .default,
         autocapitalization: TextInputAutocapitalization = .sentences,
         autocorrect: Bool = true) {
        self.title = title
        self.placeholder = placeholder
        self.isRequired = required
        self.hint = hint
        self._text = text
        self.isSecure = isSecure
        self.keyboard = keyboard
        self.autocapitalization = autocapitalization
        self.autocorrect = autocorrect
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            FieldLabel(title, required: isRequired, hint: hint)
            if isSecure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(autocapitalization)
                    .autocorrectionDisabled(!autocorrect)
            }
        }
    }
}

// MARK: - Google-branded sign-in button

struct GoogleSignInButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                GoogleGLogo()
                    .frame(width: 20, height: 20)
                Text("Continue with Google")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color(red: 0.12, green: 0.12, blue: 0.12))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Color(red: 0.855, green: 0.863, blue: 0.878), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

/// A stylized Google "G" mark using brand colors, drawn with Canvas so no asset is required.
struct GoogleGLogo: View {
    // Google brand colors
    private let blue   = Color(red: 66/255,  green: 133/255, blue: 244/255)
    private let red    = Color(red: 234/255, green: 67/255,  blue: 53/255)
    private let yellow = Color(red: 251/255, green: 188/255, blue: 5/255)
    private let green  = Color(red: 52/255,  green: 168/255, blue: 83/255)

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let thickness = size * 0.22
            let radius = size / 2 - thickness / 2
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            ZStack {
                // Blue: top-right arc
                arc(from: -30, to: 90, radius: radius, thickness: thickness, center: center, color: blue)
                // Green: bottom-right arc
                arc(from: 90, to: 180, radius: radius, thickness: thickness, center: center, color: green)
                // Yellow: bottom-left arc
                arc(from: 180, to: 270, radius: radius, thickness: thickness, center: center, color: yellow)
                // Red: top-left arc
                arc(from: 270, to: 330, radius: radius, thickness: thickness, center: center, color: red)
                // Horizontal blue bar for the "G" opening
                Rectangle()
                    .fill(blue)
                    .frame(width: size * 0.28, height: thickness * 0.9)
                    .offset(x: size * 0.16, y: 0)
            }
            .compositingGroup()
        }
    }

    private func arc(from start: Double, to end: Double,
                     radius: CGFloat, thickness: CGFloat,
                     center: CGPoint, color: Color) -> some View {
        Path { p in
            p.addArc(center: center, radius: radius,
                     startAngle: .degrees(start), endAngle: .degrees(end),
                     clockwise: false)
        }
        .stroke(color, style: StrokeStyle(lineWidth: thickness, lineCap: .butt))
    }
}

// MARK: - Menu tile for redesigned More screen

struct MenuTile: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let tint: Color

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(tint.opacity(0.15))
                    .frame(width: 40, height: 40)
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(tint)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textPrimary)
                Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}
