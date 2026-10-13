package com.lumi.recruitment.service;

import com.lumi.recruitment.entity.candidate.ResumeSections.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class ResumeFieldsTest {
    private final JsonMapper mapper = JsonMapper.builder().build();
    private boolean valid(Object value) {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            return factory.getValidator().validate(value).isEmpty();
        }
    }
    @Test void oldSnapshotsStillDeserializeAndNewFieldsRoundTrip() throws Exception {
        var legacy = mapper.readValue("{\"name\":\"Old project\",\"role\":\"Developer\",\"url\":\"\",\"description\":\"API\"}", Project.class);
        assertTrue(valid(legacy)); assertFalse(legacy.current()); assertNull(legacy.technologies());
        var project = mapper.readValue("{\"name\":\"Project\",\"startDate\":\"2025-01\",\"endDate\":\"\",\"current\":true,\"technologies\":[\"Java\",\"C++\"]}", Project.class);
        assertTrue(valid(project)); assertEquals(project, mapper.readValue(mapper.writeValueAsString(project), Project.class));
        var education = mapper.readValue("{\"school\":\"University\",\"gpa\":3.65,\"gpaScale\":4}", Education.class);
        assertTrue(valid(education)); assertEquals(education, mapper.readValue(mapper.writeValueAsString(education), Education.class));
        assertTrue(valid(mapper.readValue("{\"school\":\"Old university\"}", Education.class)));
    }
    @Test void validatesGpaScalePrecisionAndProjectRanges() throws Exception {
        for (String json : List.of("{\"gpa\":5,\"gpaScale\":4}", "{\"gpa\":-1,\"gpaScale\":4}",
                "{\"gpa\":3.333,\"gpaScale\":4}", "{\"gpa\":3.2}", "{\"gpaScale\":4}", "{\"gpa\":2,\"gpaScale\":5}"))
            assertFalse(valid(mapper.readValue(json, Education.class)), json);
        assertTrue(valid(mapper.readValue("{\"gpa\":0,\"gpaScale\":4}", Education.class)));
        for (String json : List.of("{\"startDate\":\"2026-02\",\"endDate\":\"2025-01\"}",
                "{\"startDate\":\"2025-13\"}", "{\"current\":true,\"endDate\":\"2025-01\"}", "{\"technologies\":[\"\"]}"))
            assertFalse(valid(mapper.readValue(json, Project.class)), json);
    }
    @Test void skillNormalizationIsCaseInsensitiveAndKeepsTechnologyPunctuation() {
        assertEquals(List.of("Java", "Spring Boot", "C++", "C#"), ResumeService.normalizeSkills(List.of(" Java ", "java", "Spring   Boot", "spring boot", "C++", "C#")));
        assertEquals(List.of(), ResumeService.normalizeSkills(null));
    }
}
