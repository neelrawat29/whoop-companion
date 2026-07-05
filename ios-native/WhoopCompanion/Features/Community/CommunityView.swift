import SwiftUI

struct CommunityView: View {
    @State private var vm = CommunityViewModel()
    @State private var showingCreate = false
    @State private var joinCode = ""

    var body: some View {
        List {
            Section("Join by code") {
                HStack {
                    TextField("ABCDEF", text: $joinCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button("Join") {
                        Task { await vm.join(code: joinCode); joinCode = "" }
                    }
                    .disabled(joinCode.count < 4)
                }
            }
            Section("My groups") {
                if vm.groups.isEmpty {
                    Text("No groups yet").foregroundStyle(.secondary)
                } else {
                    ForEach(vm.groups) { g in
                        NavigationLink(destination: GroupDetailView(group: g)) {
                            HStack {
                                Text(g.icon ?? "👥")
                                VStack(alignment: .leading) {
                                    Text(g.name)
                                    Text("Code: \(g.inviteCode)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Community")
        .toolbar { Button { showingCreate = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showingCreate) {
            NavigationStack {
                Form {
                    TextField("Group name", text: $vm.newName)
                    TextField("Icon (emoji)", text: $vm.newIcon)
                }
                .navigationTitle("Create group")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingCreate = false } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Create") {
                            Task { await vm.create(); showingCreate = false }
                        }
                        .disabled(vm.newName.isEmpty)
                    }
                }
            }
        }
        .task { await vm.load() }
    }
}
