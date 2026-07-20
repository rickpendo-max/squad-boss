type BlockTimelineProps = {
  previousBlock: string
  currentBlock: string
  nextBlock: string
}

function BlockTimeline({
  previousBlock,
  currentBlock,
  nextBlock,
}: BlockTimelineProps) {
  return (
    <div className="block-timeline">
      <div className="timeline-block">
        <span>Previous</span>
        <strong>{previousBlock}</strong>
      </div>

      <div className="timeline-arrow">→</div>

      <div className="timeline-block current">
        <span>Current</span>
        <strong>{currentBlock}</strong>
      </div>

      <div className="timeline-arrow">→</div>

      <div className="timeline-block">
        <span>Next</span>
        <strong>{nextBlock}</strong>
      </div>
    </div>
  )
}

export default BlockTimeline