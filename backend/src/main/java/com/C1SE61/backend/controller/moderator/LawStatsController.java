package com.C1SE61.backend.controller.moderator;

import com.C1SE61.backend.dto.response.moderator.LawStatsResponse;
import com.C1SE61.backend.service.moderator.LawStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/moderator/law-stats")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class LawStatsController {

    private final LawStatsService lawStatsService;

    @GetMapping("/{moderatorId}")
    public ResponseEntity<LawStatsResponse> getLawStats(@PathVariable Integer moderatorId) {
        LawStatsResponse res = lawStatsService.getLawStatsData(moderatorId);
        return ResponseEntity.ok(res);
    }
}

