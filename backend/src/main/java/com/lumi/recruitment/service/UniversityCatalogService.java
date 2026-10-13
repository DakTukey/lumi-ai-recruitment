package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.UniversityOptionDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
@Slf4j
public class UniversityCatalogService {

    private final ObjectMapper mapper;
    private final AtomicReference<List<UniversityOptionDto>> cache = new AtomicReference<>(null);

    private static final String HIPOLABS_API_URL = "http://universities.hipolabs.com/search?country=Viet%20Nam";

    private static final List<UniversityOptionDto> CURATED_UNIVERSITIES = List.of(
        new UniversityOptionDto("Đại học Bách khoa Hà Nội", "HUST", "Hanoi University of Science and Technology"),
        new UniversityOptionDto("Đại học Quốc gia Hà Nội", "VNU", "Vietnam National University Hanoi"),
        new UniversityOptionDto("Trường Đại học Công nghệ - ĐHQGHN", "UET", "VNU University of Engineering and Technology"),
        new UniversityOptionDto("Trường Đại học Khoa học Tự nhiên - ĐHQGHN", "HUS", "Hanoi University of Science"),
        new UniversityOptionDto("Đại học Kinh tế Quốc dân", "NEU", "Hanoi National Economics University"),
        new UniversityOptionDto("Đại học Ngoại thương", "FTU", "Foreign Trade University"),
        new UniversityOptionDto("Học viện Công nghệ Bưu chính Viễn thông", "PTIT", "Posts & Telecommunications Institute of Technology"),
        new UniversityOptionDto("Học viện Tài chính", "AOF", "Institute of Finance"),
        new UniversityOptionDto("Học viện Ngân hàng", "BA", "Banking Academy"),
        new UniversityOptionDto("Trường Đại học FPT", "FPT", "FPT University"),
        new UniversityOptionDto("Trường Đại học Giao thông Vận tải", "UTC", "Hanoi Univerisity of Transportation"),
        new UniversityOptionDto("Trường Đại học Xây dựng Hà Nội", "HUCE", "Hanoi University of Civil Engineering"),
        new UniversityOptionDto("Trường Đại học Thủy lợi", "TLU", "Water Resources University"),
        new UniversityOptionDto("Trường Đại học Công nghiệp Hà Nội", "HaUI", "Hanoi University of Industry"),
        new UniversityOptionDto("Trường Đại học Mở Hà Nội", "HOU", "Hanoi Open University"),
        new UniversityOptionDto("Trường Đại học Hà Nội", "HANU", "Hanoi University"),
        new UniversityOptionDto("Trường Đại học Sư phạm Hà Nội", "HNUE", "Hanoi National University of Education"),
        new UniversityOptionDto("Trường Đại học Mỏ - Địa chất", "HUMG", "Hanoi University of Mining and Geology"),
        new UniversityOptionDto("Trường Đại học Y Hà Nội", "HMU", "Hanoi Medical University"),
        new UniversityOptionDto("Đại học Quốc gia TP.HCM", "VNU-HCM", "Vietnam National University Ho Chi Minh City"),
        new UniversityOptionDto("Trường Đại học Công nghệ Thông tin - ĐHQG-HCM", "UIT", "University of Information Technology VNU-HCM"),
        new UniversityOptionDto("Trường Đại học Bách khoa - ĐHQG-HCM", "HCMUT", "Ho Chi Minh City University of Technology"),
        new UniversityOptionDto("Trường Đại học Khoa học Tự nhiên - ĐHQG-HCM", "HCMUS", "Ho Chi Minh City University of Science"),
        new UniversityOptionDto("Trường Đại học Kinh tế TP.HCM", "UEH", "Ho Chi Minh City University of Economics"),
        new UniversityOptionDto("Trường Đại học Sư phạm Kỹ thuật TP.HCM", "HCMUTE", "University of Technical Education Ho Chi Minh City"),
        new UniversityOptionDto("Trường Đại học Ngân hàng TP.HCM", "HUB", "Banking University of Ho Chi Minh City"),
        new UniversityOptionDto("Trường Đại học Công thương TP.HCM", "HUIT", "Ho Chi Minh City University of Industry and Trade"),
        new UniversityOptionDto("Trường Đại học Công nghiệp TP.HCM", "IUH", "Industrial University of Ho Chi Minh City"),
        new UniversityOptionDto("Trường Đại học Sài Gòn", "SGU", "Saigon University"),
        new UniversityOptionDto("Trường Đại học Mở TP.HCM", "OU", "Ho Chi Minh City Open University"),
        new UniversityOptionDto("Trường Đại học Tôn Đức Thắng", "TDTU", "Ton Duc Thang University"),
        new UniversityOptionDto("Trường Đại học Văn Lang", "VLU", "Van Lang University"),
        new UniversityOptionDto("Trường Đại học Hoa Sen", "HSU", "Hoa Sen University"),
        new UniversityOptionDto("Trường Đại học RMIT Việt Nam", "RMIT", "RMIT International University Vietnam"),
        new UniversityOptionDto("Trường Đại học Việt Đức", "VGU", "Vietnamese - German University"),
        new UniversityOptionDto("Đại học Đà Nẵng", "UD", "University of Da Nang"),
        new UniversityOptionDto("Trường Đại học Bách khoa - ĐH Đà Nẵng", "DUT", "Danang University of Technology"),
        new UniversityOptionDto("Trường Đại học Sư phạm Kỹ thuật - ĐH Đà Nẵng", "UTE", "Danang University of Technology and Education"),
        new UniversityOptionDto("Trường ĐH Công nghệ Thông tin và Truyền thông Việt - Hàn", "VKU", "Vietnam - Korea University of Information and Communication Technology"),
        new UniversityOptionDto("Trường Đại học Duy Tân", "DTU", "Duy Tan University"),
        new UniversityOptionDto("Trường Đại học Cần Thơ", "CTU", "Can-Tho University"),
        new UniversityOptionDto("Đại học Huế", "HUE", "Hue University"),
        new UniversityOptionDto("Đại học Thái Nguyên", "TNU", "Thai Nguyen University"),
        new UniversityOptionDto("Trường Đại học Nha Trang", "NTU", "Nha Trang University"),
        new UniversityOptionDto("Trường Đại học Đà Lạt", "DLU", "University of Da Lat"),
        new UniversityOptionDto("Trường Đại học Tây Nguyên", "TTU", "Tay Nguyen University"),
        new UniversityOptionDto("Trường Đại học Bình Dương", "BDU", "Binh Duong University")
    );

    public List<UniversityOptionDto> getUniversities() {
        var existing = cache.get();
        if (existing != null) {
            return existing;
        }

        List<UniversityOptionDto> result = new ArrayList<>(CURATED_UNIVERSITIES);
        try {
            var client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
            var request = HttpRequest.newBuilder()
                .uri(URI.create(HIPOLABS_API_URL))
                .timeout(Duration.ofSeconds(2))
                .header("Accept", "application/json")
                .GET()
                .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200 && response.body() != null && !response.body().isBlank()) {
                JsonNode root = mapper.readTree(response.body());
                if (root.isArray()) {
                    Set<String> knownEnglishNames = new HashSet<>();
                    for (var u : CURATED_UNIVERSITIES) {
                        if (u.englishName() != null) {
                            knownEnglishNames.add(u.englishName().trim().toLowerCase());
                        }
                    }

                    for (JsonNode item : root) {
                        String engName = item.path("name").asText("").trim();
                        if (!engName.isEmpty() && !knownEnglishNames.contains(engName.toLowerCase())) {
                            result.add(new UniversityOptionDto(engName, "", engName));
                            knownEnglishNames.add(engName.toLowerCase());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.info("Hipolabs API uncontactable, using curated university catalog: {}", e.getMessage());
        }

        result = Collections.unmodifiableList(result);
        cache.set(result);
        return result;
    }
}
