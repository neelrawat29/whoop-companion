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
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(Theme.cardBorder, lineWidth: 1)
            )
            .shadow(color: Color(red: 0.18, green: 0.42, blue: 0.54).opacity(0.08), radius: 8, x: 0, y: 2)
    }
}

extension View {
    func card() -> some View { modifier(CardStyle()) }
}
