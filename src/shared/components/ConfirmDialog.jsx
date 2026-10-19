export default function ConfirmDialog({ titleId, title, children, actions }) {
  return <div className="modal-backdrop" role="presentation">
    <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {children}
      <div>{actions}</div>
    </section>
  </div>
}
