import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline


class StockPredictor:
    """Stock price prediction using Linear Regression with polynomial features."""

    def __init__(self, degree=2):
        self.degree = degree
        self.model = make_pipeline(
            PolynomialFeatures(degree=self.degree),
            LinearRegression()
        )
        self.is_trained = False

    def train(self, prices):
        """
        Train the model on historical closing prices.

        Args:
            prices: List of historical closing prices (most recent last)
        """
        if len(prices) < 10:
            raise ValueError("Need at least 10 data points for training")

        X = np.arange(len(prices)).reshape(-1, 1)
        y = np.array(prices)

        self.model.fit(X, y)
        self.is_trained = True

        # Calculate R² score as confidence metric
        predictions = self.model.predict(X)
        ss_res = np.sum((y - predictions) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        self.r2_score = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        return self

    def predict(self, days_ahead=7):
        """
        Predict stock prices for the next N days.

        Args:
            days_ahead: Number of future days to predict

        Returns:
            List of dicts with day number and predicted price
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before predicting")

        n = self.model.named_steps['linearregression'].n_features_in_
        # Get length from polynomial features input
        last_index = 0
        for step_name, step in self.model.steps:
            if hasattr(step, 'n_features_in_'):
                break

        # Infer the training data length from the model
        future_indices = np.arange(
            self._training_length,
            self._training_length + days_ahead
        ).reshape(-1, 1)

        predicted_prices = self.model.predict(future_indices)

        predictions = []
        for i, price in enumerate(predicted_prices):
            predictions.append({
                'day': i + 1,
                'price': round(float(max(price, 0)), 2)  # Price can't be negative
            })

        return predictions

    def train(self, prices):
        """Train the model on historical closing prices."""
        if len(prices) < 10:
            raise ValueError("Need at least 10 data points for training")

        self._training_length = len(prices)
        X = np.arange(len(prices)).reshape(-1, 1)
        y = np.array(prices)

        self.model.fit(X, y)
        self.is_trained = True

        # Calculate R² as confidence
        predictions = self.model.predict(X)
        ss_res = np.sum((y - predictions) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        self.r2_score = max(0, 1 - (ss_res / ss_tot)) if ss_tot != 0 else 0

        return self

    def get_confidence(self):
        """Return the confidence score (R² clamped to 0-1)."""
        if not self.is_trained:
            return 0.0
        return round(min(max(self.r2_score, 0), 1), 4)
