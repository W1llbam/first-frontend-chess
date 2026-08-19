import type { Square } from 'chess.js'
import { getBoardSquares } from '../chess/board'
import type { PlayerColor } from '../api/invites'
import './ChessBoard.css'

type ChessBoardProps = {
    fen: string
    selectedSquare: Square | null
    legalTargets: Square[]
    onSquareClick: (square: Square) => void
    disabled: boolean
    checkedColor: PlayerColor | null
}

function ChessBoard({ fen, selectedSquare, legalTargets, onSquareClick, disabled, checkedColor }: ChessBoardProps) {
    const squares = getBoardSquares(fen)

    return (
        <div className="chessboard" aria-label="Chessboard" role="grid">
            {squares.map(({ square, piece, pieceName, pieceColor, pieceType, isLight }) => {
                const isSelected = square === selectedSquare
                const isLegalTarget = legalTargets.includes(square)
                const isCheckedKing = pieceType === 'k' && pieceColor === (checkedColor === 'white' ? 'w' : 'b')
                const squareLabel = pieceName ? `${square}, ${pieceName}` : `${square}, empty`

                return (
                    <button
                        aria-label={squareLabel}
                        aria-pressed={isSelected}
                        className={`square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isLegalTarget ? 'legal-target' : ''} ${isCheckedKing ? 'in-check' : ''}`}
                        disabled={disabled}
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
