/**
 * Loading screen shown during Jazz initialization
 */
export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-base-content">Initializing Narrative...</p>
      </div>
    </div>
  );
}
