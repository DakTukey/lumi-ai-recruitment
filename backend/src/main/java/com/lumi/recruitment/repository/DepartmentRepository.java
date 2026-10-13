package com.lumi.recruitment.repository;
import com.lumi.recruitment.entity.recruitment.Department;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DepartmentRepository extends JpaRepository<Department,UUID> {
 List<Department> findByActiveTrueOrderByNameAsc();
 boolean existsByNameIgnoreCase(String name);
}
