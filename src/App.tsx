import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke<string>("greet", { name }));
  }

  return (
    <main className="container">
      <h1>Markdown Editor</h1>
      <p>Welcome! This will become a Markdown viewer/editor.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      {greetMsg && <p>{greetMsg}</p>}
    </main>
  );
}

export default App;
