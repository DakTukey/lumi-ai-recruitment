package com.lumi.recruitment.entity.recruitment;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;
@Entity @Table(name="departments", schema="recruitment")
@Getter @Setter @NoArgsConstructor
public class Department {
 @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
 @Column(nullable=false, length=150, unique=true) private String name;
 @Column(columnDefinition="text") private String description;
 @Column(name="is_active", nullable=false) private boolean active = true;
}
