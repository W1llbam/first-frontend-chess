import { Chess, type Color, type Square } from 'chess.js'

export type BoardSquare = {
    square: Square
    piece: string
    pieceName: string | null
    pieceColor: Color | null
    pieceType: string | null
    isLight: boolean
}

const pieceSymbols: Record<Color, Record<string, string>> = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
}

const pieceNames: Record<string, string> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
}

export const STARTING_FEN = new Chess().fen()

export function getBoardSquares(fen: string): BoardSquare[] {
    const chess = new Chess(fen)

    return chess.board().flatMap((row, rowIndex) => row.map((piece, columnIndex) => {
        const file = String.fromCharCode('a'.charCodeAt(0) + columnIndex)
        const rank = String(8 - rowIndex)
        const square = `${file}${rank}` as Square
        const isLight = (rowIndex + columnIndex) % 2 === 0

        return {
            square,
            piece: piece ? pieceSymbols[piece.color][piece.type] : '',
            pieceName: piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${pieceNames[piece.type]}` : null,
            pieceColor: piece?.color ?? null,
            pieceType: piece?.type ?? null,
            isLight,
        }
    }))
}

export function getLegalTargets(fen: string, from: Square): Square[] {
    const chess = new Chess(fen)
    return chess.moves({ square: from, verbose: true }).map((move) => move.to)
}

export function getPromotionForMove(fen: string, from: Square, to: Square): 'q' | null {
    const chess = new Chess(fen)
    const piece = chess.get(from)
    const reachesBackRank = to[1] === '1' || to[1] === '8'

    return piece?.type === 'p' && reachesBackRank ? 'q' : null
}
