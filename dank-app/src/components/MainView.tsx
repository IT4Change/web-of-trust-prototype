import { useState } from 'react';
import type { DocHandle, AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument } from 'narrative-ui';
import type { Voucher } from '../schema';
// Debug extensions are auto-initialized via import
import '../debug';
import { useDankWallet } from '../hooks/useDankWallet';
import { VoucherCard } from './VoucherCard';
import { BalanceCard } from './BalanceCard';
import { CreateVoucherModal } from './CreateVoucherModal';
import { TransferVoucherModal } from './TransferVoucherModal';
import { VoucherDetailModal } from './VoucherDetailModal';

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

type TabType = 'wallet' | 'issued' | 'all';

export function MainView({
  documentId,
  currentUserDid,
  privateKey,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
}: MainViewProps) {
  // Load UserDocument for trust/verification features
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // Hook now handles docHandle internally using useDocHandle
  const {
    doc,
    docHandle,
    balances,
    activeVouchers,
    issuedVouchers,
    allHeldVouchers,
    createVoucher,
    transferVoucher,
    getValidationResult,
  } = useDankWallet({
    documentId,
    currentUserDid,
    privateKey,
  });

  // App-specific UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [transferVoucherId, setTransferVoucherId] = useState<string | null>(null);
  const [detailVoucherId, setDetailVoucherId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('wallet');

  const logoUrl = `${import.meta.env.BASE_URL}dankwallet-icon.svg`;

  // Debug state is automatically updated via useAppContext in AppLayout

  const handleCreateVoucher = async (params: {
    recipientId: string;
    amount: number;
    unit: string;
    note?: string;
    expiresAt?: number;
  }) => {
    await createVoucher(params);
  };

  const handleTransfer = async (voucherId: string, toId: string, note?: string) => {
    await transferVoucher(voucherId, toId, note);
  };

  // Get voucher for modals
  const transferVoucher_ = transferVoucherId && doc ? doc.data.vouchers[transferVoucherId] : null;
  const detailVoucher = detailVoucherId && doc ? doc.data.vouchers[detailVoucherId] : null;

  // Determine which vouchers to show based on tab
  const getDisplayVouchers = (): Voucher[] => {
    switch (activeTab) {
      case 'wallet':
        return activeVouchers;
      case 'issued':
        return issuedVouchers;
      case 'all':
        return allHeldVouchers;
      default:
        return activeVouchers;
    }
  };

  const displayVouchers = getDisplayVouchers();

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId.toString()}
      currentUserDid={currentUserDid}
      appTitle="Dank"
      workspaceName="Dank Wallet"
      hideWorkspaceSwitcher={true}
      logoUrl={logoUrl}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
    >
      {(_ctx: AppContextValue) => (
        <>
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-4 max-w-4xl">
              {/* Balance Overview */}
              {balances.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3">Dein Guthaben</h2>
                  <div className="stats stats-vertical sm:stats-horizontal shadow w-full">
                    {balances.map((balance) => (
                      <BalanceCard
                        key={balance.unit}
                        balance={balance}
                        identities={doc!.identities}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for balances */}
              {balances.length === 0 && activeTab === 'wallet' && (
                <div className="card bg-base-100 shadow mb-6">
                  <div className="card-body text-center">
                    <div className="text-6xl mb-4">0</div>
                    <p className="text-base-content/70">
                      Du hast noch keine aktiven Gutscheine.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="mb-6">
                <button
                  className="btn btn-primary w-full sm:w-auto"
                  onClick={() => setShowCreateModal(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Neuen Gutschein erstellen
                </button>
              </div>

              {/* Tabs */}
              <div className="tabs tabs-boxed mb-4">
                <button
                  className={`tab ${activeTab === 'wallet' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('wallet')}
                >
                  Meine Wallet ({activeVouchers.length})
                </button>
                <button
                  className={`tab ${activeTab === 'issued' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('issued')}
                >
                  Von mir ausgestellt ({issuedVouchers.length})
                </button>
                <button
                  className={`tab ${activeTab === 'all' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  Alle ({allHeldVouchers.length})
                </button>
              </div>

              {/* Voucher List */}
              <div className="grid gap-4 sm:grid-cols-2">
                {displayVouchers.map((voucher) => (
                  <VoucherCard
                    key={voucher.id}
                    voucher={voucher}
                    validationResult={getValidationResult(voucher.id)}
                    identities={doc!.identities}
                    currentUserDid={currentUserDid}
                    onTransfer={(id) => setTransferVoucherId(id)}
                    onViewDetails={(id) => setDetailVoucherId(id)}
                  />
                ))}
              </div>

              {/* Empty state for voucher list */}
              {displayVouchers.length === 0 && (
                <div className="text-center py-8 text-base-content/50">
                  {activeTab === 'wallet' && 'Keine aktiven Gutscheine in deiner Wallet.'}
                  {activeTab === 'issued' && 'Du hast noch keine Gutscheine ausgestellt.'}
                  {activeTab === 'all' && 'Keine Gutscheine vorhanden.'}
                </div>
              )}
            </div>
          </div>

          {/* App-specific Modals */}
          {doc && (
            <>
              <CreateVoucherModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreateVoucher={handleCreateVoucher}
                identities={doc.identities}
                currentUserDid={currentUserDid}
              />

              <TransferVoucherModal
                isOpen={!!transferVoucherId}
                onClose={() => setTransferVoucherId(null)}
                voucher={transferVoucher_}
                onTransfer={handleTransfer}
                identities={doc.identities}
                currentUserDid={currentUserDid}
              />

              <VoucherDetailModal
                isOpen={!!detailVoucherId}
                onClose={() => setDetailVoucherId(null)}
                voucher={detailVoucher}
                validationResult={detailVoucherId ? getValidationResult(detailVoucherId) : undefined}
                identities={doc.identities}
                currentUserDid={currentUserDid}
              />
            </>
          )}
        </>
      )}
    </AppLayout>
  );
}
