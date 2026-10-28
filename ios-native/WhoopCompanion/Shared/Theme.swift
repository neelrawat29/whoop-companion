import SwiftUI
import UIKit

enum Theme {
    static let accent = Color("AccentColor")
    static let background = Color("Background")
    static let card = Color("Card")
    static let cardBorder = Color("CardBorder")
    static let textPrimary = Color("TextPrimary")
    static let textSecondary = Color("TextSecondary")
    static let tile = Color(red: 251/255, green: 246/255, blue: 239/255)
    static let amber = Color(red: 244/255, green: 183/255, blue: 64/255)
    static let recovery = Color(red: 61/255, green: 126/255, blue: 84/255)
    static let sleep = Color(red: 87/255, green: 124/255, blue: 163/255)
    static let water = Color(red: 49/255, green: 132/255, blue: 145/255)
    static let protein = Color(red: 163/255, green: 95/255, blue: 114/255)
    static let danger = Color(red: 187/255, green: 62/255, blue: 47/255)
    static let onAccent = Color.white
    static let shadow = Color(red: 65/255, green: 40/255, blue: 23/255)

    static let cornerRadius: CGFloat = 12
    static let spacing: CGFloat = 16

    static func body(_ style: Font.TextStyle = .body) -> Font {
        .custom("DMSans-Regular", size: size(for: style), relativeTo: style)
    }

    static func heading(_ style: Font.TextStyle = .title2) -> Font {
        switch style {
        case .largeTitle, .title, .title2:
            return .custom("Fraunces-Regular", size: size(for: style), relativeTo: style)
        default:
            return body(style).weight(.semibold)
        }
    }

    static func number(_ size: CGFloat, relativeTo style: Font.TextStyle = .title) -> Font {
        .custom("DMSans-Regular", size: size, relativeTo: style).weight(.medium)
    }

    private static func size(for style: Font.TextStyle) -> CGFloat {
        switch style {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 24
        case .title3: return 19
        case .headline: return 17
        case .subheadline: return 15
        case .callout: return 16
        case .footnote: return 13
        case .caption: return 12
        case .caption2: return 12
        default: return 17
        }
    }

    @MainActor static func configureAppearance() {
        let navigation = UINavigationBarAppearance()
        navigation.configureWithOpaqueBackground()
        navigation.backgroundColor = UIColor(background)
        navigation.shadowColor = .clear
        let largeFont = UIFontMetrics(forTextStyle: .largeTitle).scaledFont(for: UIFont(name: "Fraunces-Regular", size: 34) ?? .systemFont(ofSize: 34))
        let titleFont = UIFontMetrics(forTextStyle: .headline).scaledFont(for: UIFont(name: "DMSans-Regular", size: 17) ?? .systemFont(ofSize: 17))
        navigation.largeTitleTextAttributes = [.font: largeFont, .foregroundColor: UIColor(textPrimary)]
        navigation.titleTextAttributes = [.font: titleFont, .foregroundColor: UIColor(textPrimary)]
        UINavigationBar.appearance().standardAppearance = navigation
        UINavigationBar.appearance().scrollEdgeAppearance = navigation
        UINavigationBar.appearance().compactAppearance = navigation
        UISegmentedControl.appearance().selectedSegmentTintColor = UIColor(card)
        UISegmentedControl.appearance().backgroundColor = UIColor(tile)
        let segmentFont = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: UIFont(name: "DMSans-Regular", size: 14) ?? .systemFont(ofSize: 14))
        UISegmentedControl.appearance().setTitleTextAttributes([.font: segmentFont, .foregroundColor: UIColor(textSecondary)], for: .normal)
        UISegmentedControl.appearance().setTitleTextAttributes([.font: segmentFont, .foregroundColor: UIColor(danger)], for: .selected)
    }
}

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(Theme.spacing)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(Theme.cardBorder, lineWidth: 1)
            )
            .shadow(color: Theme.shadow.opacity(0.05), radius: 10, x: 0, y: 3)
    }
}

struct CoveInputStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(Theme.body())
            .foregroundStyle(Theme.textPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .frame(minHeight: 48)
            .background(Theme.tile, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.cardBorder, lineWidth: 1))
    }
}

struct CoveButtonStyle: ButtonStyle {
    var prominent = false
    /// Stretch to the available width (for equal-width button rows).
    var fill = false
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(.subheadline).weight(.semibold))
            .foregroundStyle(prominent ? Theme.textPrimary : Theme.danger)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(maxWidth: fill ? .infinity : nil, minHeight: 44)
            .background(prominent ? Theme.accent : Theme.tile, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .opacity(isEnabled ? (configuration.isPressed ? 0.7 : 1) : 0.4)
    }
}

private struct CoveFormStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Theme.body())
            .foregroundStyle(Theme.textPrimary)
            .textFieldStyle(CoveInputStyle())
            .listStyle(.insetGrouped)
            .listRowBackground(Theme.card)
            .listRowSeparatorTint(Theme.cardBorder)
            .environment(\.defaultMinListRowHeight, 56)
            .scrollContentBackground(.hidden)
            .background(Theme.background.ignoresSafeArea())
    }
}

/// Solid page-coloured strip behind the status bar, for screens that hide
/// their navigation bar so scrolled content doesn't run under the clock.
private struct StatusBarBackdrop: ViewModifier {
    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            Theme.background
                .frame(height: Self.statusBarHeight)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    /// Read from the window: the tab host's layout reports no top inset to its pages.
    private static var statusBarHeight: CGFloat {
        let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
        return scene?.keyWindow?.safeAreaInsets.top ?? 0
    }
}

extension View {
    func statusBarBackdrop() -> some View { modifier(StatusBarBackdrop()) }
    func card() -> some View { modifier(CardStyle()) }
    func coveForm() -> some View { modifier(CoveFormStyle()) }
}
