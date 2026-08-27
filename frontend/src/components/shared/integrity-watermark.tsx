function IntegrityWatermark({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 grid grid-cols-2 grid-rows-3 overflow-hidden opacity-[0.055]"
      aria-hidden
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="flex -rotate-12 items-center justify-center whitespace-nowrap text-sm font-semibold"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export { IntegrityWatermark };
