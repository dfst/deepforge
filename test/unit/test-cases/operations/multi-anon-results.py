from operations import Operation
from typing import Tuple

class ExampleOperation(Operation):

    # TODO: add the type hints
    def execute(hello, world, count):
        # Doing things
        concat = hello + world
        return concat+1, count-9
