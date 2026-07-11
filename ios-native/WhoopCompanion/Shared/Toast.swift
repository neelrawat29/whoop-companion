import SwiftUI

struct ToastMessage: Equatable, Identifiable {
    enum Kind { case success, error, info }
    let id = UUID()
    let kind: Kind
    let text: String

    static func == (lhs: ToastMessage, rhs: ToastMessage) -> Bool { lhs.id == rhs.id }
}

private struct ToastView: View {
    let toast: ToastMessage

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: iconName).font(.footnote.weight(.bold))
            Text(toast.text).font(.footnote.weight(.semibold))
                .lineLimit(2)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(backgroundColor, in: Capsule())
        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
        .padding(.horizontal, 24)
    }

    private var iconName: String {
        switch toast.kind {
        case .success: return "checkmark.circle.fill"
        case .error:   return "exclamationmark.triangle.fill"
        case .info:    return "info.circle.fill"
        }
    }

    private var backgroundColor: Color {
        switch toast.kind {
        case .success: return Color(red: 0.13, green: 0.66, blue: 0.34)
        case .error:   return Color(red: 0.85, green: 0.24, blue: 0.24)
        case .info:    return Color.accentColor
        }
    }
}

private struct ToastModifier: ViewModifier {
    @Binding var toast: ToastMessage?
    var duration: Double = 2.0

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let current = toast {
                    ToastView(toast: current)
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .task(id: current.id) {
                            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
                            withAnimation(.easeInOut(duration: 0.25)) {
                                if toast?.id == current.id { toast = nil }
                            }
                        }
                        .zIndex(1)
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
    }
}

extension View {
    func toast(_ toast: Binding<ToastMessage?>, duration: Double = 2.0) -> some View {
        modifier(ToastModifier(toast: toast, duration: duration))
    }
}
