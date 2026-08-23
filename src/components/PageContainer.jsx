export default function PageContainer({ children, className = "" }) {
  return (
    <main
      className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 ${className}`}
    >
      {children}
    </main>
  );
}
