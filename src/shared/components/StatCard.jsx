export default function StatCard({ value, label }) {
  return <article className="stat"><strong>{value}</strong><span>{label}</span></article>
}
