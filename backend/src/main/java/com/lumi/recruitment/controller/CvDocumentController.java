package com.lumi.recruitment.controller;
import com.lumi.recruitment.service.CvDocumentService;
import com.lumi.recruitment.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.http.*;
import java.util.*;
@RestController @RequiredArgsConstructor
public class CvDocumentController {
 private final CvDocumentService service;
 @GetMapping("/api/candidate/cv-documents") public ResponseEntity<?> list(Authentication a) {return json(service.list(a));}
 @PostMapping(value="/api/candidate/cv-documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ResponseEntity<?> upload(Authentication a,@RequestParam("file") MultipartFile f) {return json(service.upload(a,f));}
 @GetMapping("/api/candidate/cv-documents/{id}") public ResponseEntity<?> get(Authentication a,@PathVariable UUID id) {return json(service.get(a,id));}
 public record RenameDocumentRequest(String title) {}
 @PutMapping("/api/candidate/cv-documents/{id}/name") public ResponseEntity<?> rename(Authentication a,@PathVariable UUID id,@RequestBody RenameDocumentRequest input) {return json(service.rename(a,id,input.title()));}
 @PutMapping("/api/candidate/cv-documents/{id}/default") public ResponseEntity<?> makeDefault(Authentication a,@PathVariable UUID id) {return json(service.makeDefault(a,id));}
 @PostMapping("/api/candidate/cv-documents/{id}/parse") public ResponseEntity<?> parse(Authentication a,@PathVariable UUID id) {return json(service.parse(a,id));}
 @PutMapping("/api/candidate/cv-documents/{id}/review") public ResponseEntity<?> review(Authentication a,@PathVariable UUID id,@RequestBody CvDocumentService.ReviewRequest input) {return json(service.review(a,id,input));}
 @GetMapping("/api/candidate/cv-documents/{id}/file") public ResponseEntity<byte[]> own(Authentication a,@PathVariable UUID id) {return pdf(service.ownFile(a,id));}
 @GetMapping("/api/recruiter/applications/{id}/cv-file") public ResponseEntity<byte[]> submitted(Authentication a,@PathVariable UUID id) {return pdf(service.applicationFile(a,id));}
 @GetMapping("/api/recruiter/applications/{id}/cv-extraction") public ResponseEntity<?> extraction(Authentication a,@PathVariable UUID id) {return json(service.applicationExtraction(a,id));}
 private ResponseEntity<?> json(Object data) {return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok("PDF của bạn.",data));}
 private ResponseEntity<byte[]> pdf(byte[] bytes) {
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_PDF)
   .header("Content-Disposition","inline; filename=\"cv.pdf\"").header("X-Content-Type-Options","nosniff")
   .header("X-Frame-Options","SAMEORIGIN").header("Content-Security-Policy","frame-ancestors 'self'").body(bytes);
 }
}
