import SwiftUI

enum Theme {
    static let accent = Color("AccentColor")
    static let background = Color("Background")
    static let card = Color("Card")
    static let cardBorder = Color("CardBorder")
    static let textPrimary = Color("TextPrimary")
    static let textSecondary = Color("TextSecondary")

    static let cornerRadius: CGFloat = 16
    static let spacing: CGFloat = 16
}

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(Theme.spacing)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.06), lineWidth: 1)
            )
    }
}

extension View {
    func card() -> some View { modifier(CardStyle()) }
}
