from operations import Operation
from typing import Tuple

class ExampleOperation(Operation):

    def execute(hello: str, world: str, count: int) -> Tuple[str, int]:
        # Doing things
        concat = hello + world
        return concat, count
