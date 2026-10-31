export default function ExamDeliveryCount({ count = 0 }) {
  const total = Number(count) || 0
  return <span className="exam-delivery-count" aria-label={`${total} entregas`} title={`${total} entregas`}>({total})</span>
}
