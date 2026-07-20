type CardProps = {
  eyebrow?: string
  title: string
  children: React.ReactNode
}

function Card({ eyebrow, title, children }: CardProps) {
  return (
    <div className="card">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}

      <h2>{title}</h2>

      {children}
    </div>
  )
}

export default Card