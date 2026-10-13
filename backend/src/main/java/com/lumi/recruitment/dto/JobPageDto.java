package com.lumi.recruitment.dto;
import java.util.List;
public record JobPageDto(List<JobDto> content, int page, int size, long totalElements, int totalPages, boolean first, boolean last) {}
