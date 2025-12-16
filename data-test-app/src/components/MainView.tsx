import type { DocHandle, AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import { useDocHandle, useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument } from 'narrative-ui';
import type { DataTestAppDoc } from '../schema';
// Debug extensions are auto-initialized via main.tsx import
import '../debug';

interface MainViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;
  // User Document (from AppShell when enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
}

export function MainView({
  documentId,
  currentUserDid,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
}: MainViewProps) {
  // Load UserDocument for trust/verification features
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // In automerge-repo v2.x, useDocHandle handles async loading
  const docHandle = useDocHandle<DataTestAppDoc>(documentId);
  const [doc] = useDocument<DataTestAppDoc>(documentId);

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  // Update identity in the document
  const updateIdentity = (did: string, updates: { displayName?: string; avatarUrl?: string }) => {
    if (!docHandle) return;
    docHandle.change((d) => {
      if (!d.identities[did]) {
        d.identities[did] = {};
      }
      if (updates.displayName !== undefined) {
        d.identities[did].displayName = updates.displayName;
      }
      if (updates.avatarUrl !== undefined) {
        d.identities[did].avatarUrl = updates.avatarUrl;
      }
      d.lastModified = Date.now();
    });
  };

  if (!doc) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId.toString()}
      currentUserDid={currentUserDid}
      appTitle="Data Layer Test"
      workspaceName="Data Layer Test"
      hideWorkspaceSwitcher={false}
      logoUrl={logoUrl}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={(updates) => updateIdentity(currentUserDid, updates)}
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
    >
      {(_ctx: AppContextValue) => (
        <>
          {/* Main Content - customize this for your app */}
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-4 max-w-4xl">
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Welcome to Data Layer Test!</h2>
                  <p>
                    Your new Narrative app is ready. Edit{' '}
                    <code className="bg-base-200 px-1 rounded">src/components/MainView.tsx</code>{' '}
                    to get started.
                  </p>
                  <p className="text-sm opacity-70">
                    Document: {documentId.toString().slice(0, 20)}...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
