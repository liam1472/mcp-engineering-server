"""Python function samples for testing function indexer"""

from typing import List, Dict, Optional, TypeVar
from dataclasses import dataclass

T = TypeVar('T')


def calculate_sum(a: int, b: int) -> int:
    """Calculate sum of two numbers."""
    return a + b


def multiply(x: float, y: float) -> float:
    """Multiply two numbers."""
    return x * y


async def fetch_data(url: str) -> dict:
    """Fetch data from URL."""
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()


def identity(arg: T) -> T:
    """Generic identity function."""
    return arg


def create_user(name: str, age: int) -> Dict[str, any]:
    """Create a user dictionary."""
    import uuid
    return {
        'name': name,
        'age': age,
        'id': str(uuid.uuid4())
    }


@dataclass
class User:
    """User data class."""
    name: str
    age: int
    email: Optional[str] = None

    def get_display_name(self) -> str:
        """Get display name."""
        return f"{self.name} ({self.age})"


class Calculator:
    """Calculator class."""

    def __init__(self, initial: float = 0):
        self._value = initial

    def add(self, n: float) -> 'Calculator':
        """Add a number."""
        self._value += n
        return self

    def subtract(self, n: float) -> 'Calculator':
        """Subtract a number."""
        self._value -= n
        return self

    def get_value(self) -> float:
        """Get current value."""
        return self._value

    @classmethod
    def create(cls, initial: float) -> 'Calculator':
        """Factory method."""
        return cls(initial)


def process_items(items: List[str], callback: callable) -> List[str]:
    """Process items with callback."""
    return [callback(item) for item in items]
