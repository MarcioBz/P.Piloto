"""Servidor local opcional. Requer apenas Python 3 da máquina."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        with ThreadingHTTPServer(("127.0.0.1", 5500), handler) as server:
            print("AlunoTec: http://127.0.0.1:5500/index.html", flush=True)
            print("Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.", flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    except OSError as error:
        print(f"Não foi possível abrir a porta 5500: {error}")
        print("Se o Live Server já estiver aberto, use o endereço dele.")
