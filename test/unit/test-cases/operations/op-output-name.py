from operations import Operation
from typing import Tuple

class ExampleOperation(Operation):

    def execute(hello, world, count):
        self.myOutput = hello + world
        return self.myOutput
