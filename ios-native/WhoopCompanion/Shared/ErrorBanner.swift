import SwiftUI

/// Inline, persistent error message with an optional Retry action.
/// Use inside ScrollView stacks or as a List/Form row.
struct ErrorBanner: View {
    let message: String
    var retryTitle: String = "Try again"
    var onRetry: (() -> Void)? = nil
    var onDismiss: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.amber)
                .accessibilityHidden(true)
            Text(message)
                .font(Theme.body(.footnote))
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            if let onRetry {
                Button(retryTitle, action: onRetry)
                    .font(Theme.body(.footnote).weight(.semibold))
                    .buttonStyle(.borderless)
                    .frame(minHeight: 44)
            }
            if let onDismiss {
                Button(action: onDismiss) {
                    Image(systemName: "xmark").font(Theme.body(.footnote).weight(.semibold))
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .foregroundStyle(Theme.textSecondary)
                .accessibilityLabel("Dismiss")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .background(Theme.amber.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}

/// Turns raw network errors into plain language.
func friendlyError(_ raw: String) -> String {
    let l = raw.lowercased()
    if l.contains("offline") || l.contains("internet") || l.contains("network") || l.contains("timed out") {
        return "You appear to be offline. Check your connection and try again."
    }
    if l.contains("jwt") || l.contains("not signed in") || l.contains("401") {
        return "Your session expired. Sign out and back in, then try again."
    }
    return raw
}
