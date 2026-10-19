export default function FormSection({ title, aside, children }) {
  return <section className="form-section"><div className="section-title"><h2>{title}</h2>{aside && <span>{aside}</span>}</div>{children}</section>
}
