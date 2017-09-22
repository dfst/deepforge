from operations import Operation
from typing import Tuple

class ExampleOperation(Operation):

    # TODO: add the type hints
    def execute(hello, world, count):
        # Doing things
        concat = hello + world + hello
        return concat, count

    def other_method(a, b, c):
        # Doing things
        return a+b/c
