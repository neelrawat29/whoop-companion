import SwiftUI
import UIKit

// Attach a single system keyboard toolbar with a right-aligned Done button
// to the container view. SwiftUI shows the toolbar automatically whenever
// any focused text input inside this container brings up the keyboard, and
// hides it when the keyboard dismisses.
//
// Apply this ONCE at the top-level container of each screen that has text
// input (Form / ScrollView / NavigationStack). Do not apply per-field —
// that would stack multiple Done buttons.
extension View {
    func keyboardDoneToolbar() -> some View {
        self.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil, from: nil, for: nil
                    )
                }
                .fontWeight(.semibold)
            }
        }
    }
}
