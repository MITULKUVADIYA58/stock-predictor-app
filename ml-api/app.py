from flask import Flask, request, jsonify
from flask_cors import CORS
from model import StockPredictor

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'ml-api'})


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict future stock prices based on historical data.

    Expects JSON body:
    {
        "symbol": "RELIANCE.BSE",
        "prices": [150.0, 151.5, ...],
        "dates": ["2024-01-01", ...]
    }

    Returns:
    {
        "symbol": "RELIANCE.BSE",
        "predictions": [{"day": 1, "price": 155.2}, ...],
        "confidence": 0.85
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        symbol = data.get('symbol', 'UNKNOWN')
        prices = data.get('prices', [])
        dates = data.get('dates', [])

        if len(prices) < 10:
            return jsonify({'error': 'At least 10 price data points required'}), 400

        # Train model
        predictor = StockPredictor(degree=2)
        predictor.train(prices)

        # Predict next 7 days
        predictions = predictor.predict(days_ahead=7)
        confidence = predictor.get_confidence()

        return jsonify({
            'symbol': symbol,
            'predictions': predictions,
            'confidence': confidence,
            'method': 'polynomial_regression',
            'training_samples': len(prices),
        })

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f'Prediction error: {e}')
        return jsonify({'error': 'Internal prediction error'}), 500


if __name__ == '__main__':
    print('🧠 ML Prediction API running on http://localhost:5001')
    app.run(host='0.0.0.0', port=5001, debug=True)
