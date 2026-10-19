import SwiftUI

struct CommunityView: View {
    @State private var vm = CommunityViewModel()
    @State private var showingCreate = false
    @State private var joinCode = ""
    @State private var joining = false
    @State private var creating = false

    var body: some View {
        List {
            if let err = vm.errorMessage {
                Section {
                    ErrorBanner(message: err,
                                onRetry: err.hasPrefix("Couldn't load") ? { Task { await vm.load() } } : nil,
                                onDismiss: { vm.errorMessage = nil })
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }
            Section("Join by code") {
                HStack {
                    TextField("ABCDEF", text: $joinCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button {
                        Task {
                            joining = true
                            if await vm.join(code: joinCode) { joinCode = ""; Haptics.success() } else { Haptics.error() }
                            joining = false
                        }
                    } label: {
                        if joining { ProgressView() } else { Text("Join") }
                    }
                    .disabled(joinCode.count < 4 || joining)
                }
            }
            Section("My groups") {
                if vm.groups.isEmpty {
                    if vm.isLoading && !vm.hasLoaded {
                        ProgressView().frame(maxWidth: .infinity)
                    } else if vm.errorMessage == nil || !vm.errorMessage!.hasPrefix("Couldn't load") {
                        Text("No groups yet. Join with a code or tap + to create one.").foregroundStyle(Theme.textSecondary)
                    }
                } else {
                    ForEach(vm.groups) { g in
                        NavigationLink(destination: GroupDetailView(group: g)) {
                            HStack {
                                Text(g.icon ?? "👥")
                                VStack(alignment: .leading) {
                                    Text(g.name)
                                    Text("Code: \(g.inviteCode)").font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .coveForm()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Community")
        .refreshable { await vm.load() }
        .toolbar {
            Button { vm.createError = nil; showingCreate = true } label: { Image(systemName: "plus") }
                .accessibilityLabel("Create group")
        }
        .sheet(isPresented: $showingCreate) {
            NavigationStack {
                Form {
                    TextField("Group name", text: $vm.newName)
                    TextField("Icon (emoji)", text: $vm.newIcon)
                    if let err = vm.createError {
                        Text(err).font(Theme.body(.footnote)).foregroundStyle(Theme.danger)
                    }
                }
                .coveForm()
        .scrollDismissesKeyboard(.interactively)
                .navigationTitle("Create group")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingCreate = false } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            Task {
                                creating = true
                                if await vm.create() { Haptics.success(); showingCreate = false } else { Haptics.error() }
                                creating = false
                            }
                        } label: {
                            if creating { ProgressView() } else { Text("Create") }
                        }
                        .disabled(vm.newName.isEmpty || creating)
                    }
                }
            }
        }
        .task { await vm.load() }
    }
}
