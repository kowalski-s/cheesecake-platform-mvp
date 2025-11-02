export default function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition-all duration-300 ease-out shadow-sm'
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-muted',
    outline: 'border border-slate-200 text-brand hover:bg-brand/10',
    ghost: 'text-brand hover:bg-brand/10',
  }
  return (
    <button className={`${base} ${styles[variant] || styles.primary} ${className}`} {...props}>
      {children}
    </button>
  )
}