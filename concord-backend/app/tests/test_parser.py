import pytest
from fastapi import HTTPException
from app.services.doc_parser import DocParser

def test_validate_signature():
    parser = DocParser()
    
    # Test correct signatures
    assert parser._validate_signature(b"%PDF-1.5...", "sample.pdf") == "pdf"
    assert parser._validate_signature(b"PK\x03\x04...", "sample.docx") == "docx"
    assert parser._validate_signature(b"plain text here", "sample.txt") == "txt"

    # Test incorrect signatures (e.g. renamed extension)
    with pytest.raises(HTTPException) as exc_info:
        parser._validate_signature(b"renamed file content", "sample.pdf")
    assert exc_info.value.status_code == 400
    assert "PDF but does not match PDF signature" in exc_info.value.detail

    with pytest.raises(HTTPException) as exc_info:
        parser._validate_signature(b"renamed file content", "sample.docx")
    assert exc_info.value.status_code == 400
    assert "DOCX but does not match DOCX signature" in exc_info.value.detail

    # Test unsupported extension
    with pytest.raises(HTTPException) as exc_info:
        parser._validate_signature(b"some content", "sample.png")
    assert exc_info.value.status_code == 400
    assert "Unsupported file format" in exc_info.value.detail

def test_validate_readability():
    parser = DocParser()

    # Empty document check
    with pytest.raises(HTTPException) as exc_info:
        parser._validate_readability("", "txt", False)
    assert exc_info.value.status_code == 400
    assert "blank or contains no contract content" in exc_info.value.detail

    # Scanned PDF check (very low word count)
    with pytest.raises(HTTPException) as exc_info:
        parser._validate_readability("Hello world PDF", "pdf", False)
    assert exc_info.value.status_code == 400
    assert "scanned images with no readable text" in exc_info.value.detail

    # Word count check (less than 50 words / 200 chars)
    short_content = "This is a short contract content page. It lacks the sufficient amount of detail required to perform a meaningful parse."
    with pytest.raises(HTTPException) as exc_info:
        parser._validate_readability(short_content, "txt", False)
    assert exc_info.value.status_code == 400
    assert "Extracted content is too short" in exc_info.value.detail

    # Valid content check
    valid_content = " ".join(["word"] * 60) # 60 words
    assert len(parser._validate_readability(valid_content, "txt", False)) > 0
