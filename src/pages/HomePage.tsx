import { useNavigate } from "react-router-dom"

function HomePage() {
    const navigate = useNavigate()

    return (
        <section id="center">
            <h1>Chess App</h1>
            <p>Welcome to the game.</p>

            <button onClick={() => navigate('/invite')}>
                Play with a friend
            </button>
        </section>
    )
}

export default HomePage