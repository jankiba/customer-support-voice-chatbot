export function SkeletonList({ rows = 3 }) {
    return (
        <div className="border border-ink-700 rounded-xl overflow-hidden divide-y divide-ink-700">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 bg-ink-900 flex items-center justify-between animate-pulse">
                    <div className="h-3.5 bg-ink-700 rounded w-2/5" />
                    <div className="h-3 bg-ink-700 rounded w-1/6" />
                </div>
            ))}
        </div>
    );
}

export function EmptyState({ icon, title, subtitle }) {
    return (
        <div className="py-14 flex flex-col items-center text-center border border-dashed border-ink-700 rounded-xl">
            <div className="w-11 h-11 rounded-full bg-ink-800 flex items-center justify-center text-mist-400 mb-3">
                {icon}
            </div>
            <p className="text-mist-200 text-sm font-medium">{title}</p>
            {subtitle && <p className="text-mist-400 text-xs mt-1 max-w-xs">{subtitle}</p>}
        </div>
    );
}