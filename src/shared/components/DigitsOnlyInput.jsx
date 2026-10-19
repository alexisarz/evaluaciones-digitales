export default function DigitsOnlyInput({ value, onChange, ...props }) {
  return <input
    {...props}
    type="text"
    inputMode="numeric"
    pattern="[0-9]+"
    value={value}
    onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
  />
}
