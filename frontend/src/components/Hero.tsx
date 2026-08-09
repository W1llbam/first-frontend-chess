import './Hero.css'
import { Link } from "react-router-dom"

function Hero() {
    return (
        <main>
            <section className="hero">
                <h1>Play chess with a friend</h1>

                <p>
                    Create a private match, share the invite link, and start playing.
                </p>

                <Link className="create-match-button" to="/create-match">
                Create Match
                </Link>

            </section>
        </main>
    )
}

export default Hero;
