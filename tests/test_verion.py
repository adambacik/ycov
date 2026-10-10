import ycov

def test_package_imports() -> None:
    assert ycov.__name__ == "ycov"
