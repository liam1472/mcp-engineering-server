from flask import Flask, jsonify

app = Flask(__name__)

def calculate_total(items: list) -> float:
    """Calculate total price of items."""
    return sum(item.get('price', 0) for item in items)

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True)
