import type { Square } from 'chess.js'
import { getBoardSquares } from '../chess/board'
import './ChessBoard.css'

type ChessBoardProps = {
    fen: string
    selectedSquare: Square | null
    legalTargets: Square[]
    onSquareClick: (square: Square) => void
}

function ChessBoard({ fen, selectedSquare, legalTargets, onSquareClick }: ChessBoardProps) {
    const squares = getBoardSquares(fen)

    return (
        <div className="chessboard" aria-label="Chessboard" role="grid">
            {squares.map(({ square, piece, pieceName, isLight }) => {
                const isSelected = square === selectedSquare
                const isLegalTarget = legalTargets.includes(square)
                const squareLabel = pieceName ? `${square}, ${pieceName}` : `${square}, empty`

                return (
                    <button
                        aria-label={squareLabel}
                        aria-pressed={isSelected}
                        className={`square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isLegalTarget ? 'legal-target' : ''}`}
                        key={square}
                        onClick={() => onSquareClick(square)}
                        role="gridcell"
                        type="button"
                    >
                        <span aria-hidden="true">{piece}</span>
                    </button>
                )
            })}
        </div>
    )
}

export default ChessBoard
