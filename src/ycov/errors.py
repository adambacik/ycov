"""Errors that ycov reports to the user as a one-line message."""


class YcovInputError(Exception):
    """Invalid input (file, format, content): the message names the file and the reason."""
