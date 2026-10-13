package com.lumi.recruitment.entity.catalog;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "skills", schema = "catalog")
@Getter @Setter @NoArgsConstructor
public class Skill {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, columnDefinition = "text") private String name;
    @org.hibernate.annotations.Generated(event = {
            org.hibernate.generator.EventType.INSERT, org.hibernate.generator.EventType.UPDATE})
    @Setter(AccessLevel.NONE)
    @Column(name = "normalized_name", nullable = false, columnDefinition = "text", insertable = false, updatable = false)
    private String normalizedName;
    @Column(name = "is_active", nullable = false) private boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @PrePersist void create() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void update() { updatedAt = Instant.now(); }
}
